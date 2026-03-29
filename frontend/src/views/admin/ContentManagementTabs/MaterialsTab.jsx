import React, { useState, useEffect } from "react";
import apiInstance from "../../../utils/axios";
import Toast from "../../plugin/Toast";

/**
 * Materials Tab Component
 * Handles CRUD operations for course categories and tags
 * ✨ PHASE 4: Extracted from KelolaMaterialAdmin.jsx for merged Content Management
 * ✨ PHASE X: Added course tags management alongside categories
 */
function MaterialsTab() {
    // Categories State
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState("add"); // 'add' or 'edit'
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [formData, setFormData] = useState({ title: "", image: "", active: true });
    const [formErrors, setFormErrors] = useState({});
    const [searchTerm, setSearchTerm] = useState("");
    
    // Tags State
    const [tags, setTags] = useState([]);
    const [tagsLoading, setTagsLoading] = useState(true);
    const [showTagsModal, setShowTagsModal] = useState(false);
    const [tagModalMode, setTagModalMode] = useState("add"); // 'add' or 'edit'
    const [selectedTag, setSelectedTag] = useState(null);
    const [tagFormData, setTagFormData] = useState({ title: "", active: true });
    const [tagFormErrors, setTagFormErrors] = useState({});
    const [tagSearchTerm, setTagSearchTerm] = useState("");
    
    // Active Tab State
    const [activeTab, setActiveTab] = useState("categories"); // 'categories' or 'tags'
    
    // Delete Confirmation Modal State
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteTargetType, setDeleteTargetType] = useState(null); // 'category' or 'tag'
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        fetchCategories();
        fetchTags();
    }, []);

    // ============= CATEGORIES FUNCTIONS =============
    const fetchCategories = async () => {
        try {
            setLoading(true);
            const response = await apiInstance.get("admin/category/");
            // Handle both paginated and direct array responses
            const data = Array.isArray(response.data) ? response.data : (response.data?.results || []);
            setCategories(data);
        } catch (error) {
            console.error("Error fetching categories:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat kategori"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleAddCategory = () => {
        setFormData({ title: "", image: "", active: true });
        setFormErrors({});
        setModalMode("add");
        setSelectedCategory(null);
        setShowModal(true);
    };

    const handleEditCategory = (category) => {
        setFormData({
            title: category.title,
            image: category.image,
            active: category.active
        });
        setFormErrors({});
        setModalMode("edit");
        setSelectedCategory(category);
        setShowModal(true);
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value
        }));
        // Clear error for this field
        if (formErrors[name]) {
            setFormErrors(prev => ({
                ...prev,
                [name]: ""
            }));
        }
    };

    const validateForm = () => {
        const errors = {};
        if (!formData.title || formData.title.trim() === "") {
            errors.title = "Nama kategori wajib diisi";
        }
        if (formData.title.trim().length < 2) {
            errors.title = "Nama kategori setidaknya harus 2 karakter";
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSaveCategory = async () => {
        if (!validateForm()) return;

        try {
            const payload = {
                title: formData.title.trim(),
                image: formData.image || "",
                active: formData.active
            };

            if (modalMode === "add") {
                await apiInstance.post("admin/category/", payload);
                Toast().fire({
                    icon: "success",
                    title: "Kategori berhasil dibuat"
                });
            } else {
                await apiInstance.put(`admin/category/${selectedCategory.id}/`, payload);
                Toast().fire({
                    icon: "success",
                    title: "Kategori berhasil diperbarui"
                });
            }

            setShowModal(false);
            setFormData({ title: "", image: "", active: true });
            fetchCategories();
        } catch (error) {
            console.error("Error saving category:", error);
            const errorMsg = error.response?.data?.title?.[0] || error.response?.data?.error || "Gagal menyimpan kategori";
            setFormErrors({ submit: errorMsg });
            Toast().fire({
                icon: "error",
                title: errorMsg
            });
        }
    };

    const handleDeleteCategoryClick = (category) => {
        setDeleteTargetType('category');
        setDeleteTarget(category);
        setShowDeleteConfirm(true);
    };

    const handleDeleteCategory = async (category) => {

        try {
            const response = await apiInstance.delete(`admin/category/${category.id}/`);
            
            // Handle both 200 OK and 204 NO_CONTENT responses
            if (response.status === 204 || response.status === 200) {
                Toast().fire({
                    icon: "success",
                    title: "Kategori berhasil dihapus"
                });
                setShowDeleteConfirm(false);
                setDeleteTarget(null);
                fetchCategories();
            }
        } catch (error) {
            console.error("Error deleting category:", error);
            
            // Handle different error scenarios
            if (error.response?.status === 400) {
                // Category has courses
                const errorMsg = error.response?.data?.error || "Tidak dapat menghapus kategori yang memiliki kursus";
                Toast().fire({
                    icon: "warning",
                    title: errorMsg
                });
            } else if (error.response?.status === 404) {
                Toast().fire({
                    icon: "error",
                    title: "Kategori tidak ditemukan"
                });
                fetchCategories();
            } else if (error.response?.status === 403) {
                Toast().fire({
                    icon: "error",
                    title: "Anda tidak memiliki izin untuk menghapus kategori ini"
                });
            } else {
                const errorMsg = error.response?.data?.error || error.response?.data?.detail || "Gagal menghapus kategori";
                Toast().fire({
                    icon: "error",
                    title: errorMsg
                });
            }
        } finally {
            setIsDeleting(false);
        }
    };

    // ============= TAGS FUNCTIONS =============
    const fetchTags = async () => {
        try {
            setTagsLoading(true);
            const response = await apiInstance.get("admin/tag/");
            // Handle both paginated and direct array responses
            const data = Array.isArray(response.data) ? response.data : (response.data?.results || []);
            setTags(data);
        } catch (error) {
            console.error("Error fetching tags:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat tag"
            });
        } finally {
            setTagsLoading(false);
        }
    };

    const handleAddTag = () => {
        setTagFormData({ title: "", active: true });
        setTagFormErrors({});
        setTagModalMode("add");
        setSelectedTag(null);
        setShowTagsModal(true);
    };

    const handleEditTag = (tag) => {
        setTagFormData({
            title: tag.title,
            active: tag.active
        });
        setTagFormErrors({});
        setTagModalMode("edit");
        setSelectedTag(tag);
        setShowTagsModal(true);
    };

    const handleTagFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setTagFormData(prev => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value
        }));
        // Clear error for this field
        if (tagFormErrors[name]) {
            setTagFormErrors(prev => ({
                ...prev,
                [name]: ""
            }));
        }
    };

    const validateTagForm = () => {
        const errors = {};
        if (!tagFormData.title || tagFormData.title.trim() === "") {
            errors.title = "Nama tag wajib diisi";
        }
        if (tagFormData.title.trim().length < 2) {
            errors.title = "Nama tag setidaknya harus 2 karakter";
        }
        setTagFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSaveTag = async () => {
        if (!validateTagForm()) return;

        try {
            const payload = {
                title: tagFormData.title.trim(),
                active: tagFormData.active
            };

            if (tagModalMode === "add") {
                await apiInstance.post("admin/tag/", payload);
                Toast().fire({
                    icon: "success",
                    title: "Tag berhasil dibuat"
                });
            } else {
                await apiInstance.put(`admin/tag/${selectedTag.id}/`, payload);
                Toast().fire({
                    icon: "success",
                    title: "Tag berhasil diperbarui"
                });
            }

            setShowTagsModal(false);
            setTagFormData({ title: "", active: true });
            fetchTags();
        } catch (error) {
            console.error("Error saving tag:", error);
            const errorMsg = error.response?.data?.title?.[0] || error.response?.data?.error || "Gagal menyimpan tag";
            setTagFormErrors({ submit: errorMsg });
            Toast().fire({
                icon: "error",
                title: errorMsg
            });
        }
    };

    const handleDeleteTagClick = (tag) => {
        setDeleteTargetType('tag');
        setDeleteTarget(tag);
        setShowDeleteConfirm(true);
    };

    const handleDeleteTag = async (tag) => {
        setIsDeleting(true);

        try {
            const response = await apiInstance.delete(`admin/tag/${tag.id}/`);
            
            // Handle both 200 OK and 204 NO_CONTENT responses
            if (response.status === 204 || response.status === 200) {
                Toast().fire({
                    icon: "success",
                    title: "Tag berhasil dihapus"
                });
                setShowDeleteConfirm(false);
                setDeleteTarget(null);
                fetchTags();
            }
        } catch (error) {
            console.error("Error deleting tag:", error);
            
            // Handle different error scenarios
            if (error.response?.status === 400) {
                // Tag has courses
                const errorMsg = error.response?.data?.error || "Tidak dapat menghapus tag yang memiliki kursus";
                Toast().fire({
                    icon: "warning",
                    title: errorMsg
                });
            } else if (error.response?.status === 404) {
                Toast().fire({
                    icon: "error",
                    title: "Tag tidak ditemukan"
                });
                fetchTags();
            } else if (error.response?.status === 403) {
                Toast().fire({
                    icon: "error",
                    title: "Anda tidak memiliki izin untuk menghapus tag ini"
                });
            } else {
                const errorMsg = error.response?.data?.error || error.response?.data?.detail || "Gagal menghapus tag";
                Toast().fire({
                    icon: "error",
                    title: errorMsg
                });
            }
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredCategories = categories.filter(cat =>
        cat.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredTags = tags.filter(tag =>
        tag.title.toLowerCase().includes(tagSearchTerm.toLowerCase())
    );

    // Calculate stats
    const stats = {
        total: categories.length,
        active: categories.filter(c => c.active).length,
        withCourses: categories.filter(c => c.course_count > 0).length,
        totalCourses: categories.reduce((sum, c) => sum + c.course_count, 0)
    };

    const tagStats = {
        total: tags.length,
        active: tags.filter(t => t.active).length,
        withCourses: tags.filter(t => t.course_count > 0).length,
        totalCourses: tags.reduce((sum, t) => sum + t.course_count, 0)
    };

    return (
        <div className="cm-tab-content cm-materials-tab">
            <div className="cm-tab-header d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h3 className="mb-1">
                        <i className="fas fa-book-atlas me-2"></i>
                        Kelola Materi
                    </h3>
                    <p className="text-muted small mb-0">Kelola kategori dan tag kursus dengan kontrol penuh atas organisasi konten</p>
                </div>
                <button 
                    className="btn btn-primary"
                    onClick={activeTab === 'categories' ? handleAddCategory : handleAddTag}
                >
                    <i className="fas fa-plus me-2"></i>
                    {activeTab === 'categories' ? 'Tambah Kategori' : 'Tambah Tag'}
                </button>
            </div>

            {/* Tab Navigation */}
            <div className="mb-4">
                <ul className="nav nav-tabs" role="tablist">
                    <li className="nav-item" role="presentation">
                        <button 
                            className={`nav-link ${activeTab === 'categories' ? 'active' : ''}`}
                            id="categories-tab"
                            type="button"
                            role="tab"
                            aria-controls="categories-content"
                            aria-selected={activeTab === 'categories'}
                            onClick={() => setActiveTab('categories')}
                        >
                            <i className="fas fa-layer-group me-2"></i>Kategori Kursus
                        </button>
                    </li>
                    <li className="nav-item" role="presentation">
                        <button 
                            className={`nav-link ${activeTab === 'tags' ? 'active' : ''}`}
                            id="tags-tab"
                            type="button"
                            role="tab"
                            aria-controls="tags-content"
                            aria-selected={activeTab === 'tags'}
                            onClick={() => setActiveTab('tags')}
                        >
                            <i className="fas fa-tags me-2"></i>Kursus Tag ({tags.length})
                        </button>
                    </li>
                </ul>
            </div>

            {/* CATEGORIES SECTION */}
            {activeTab === 'categories' && (
            <>
            {/* Statistics Cards */}
            <div className="row mb-4">
                <div className="col-lg-3 col-md-6 mb-3">
                    <div className="cm-stat-card stat-primary">
                        <div className="cm-stat-card-body">
                            <div className="cm-stat-icon">
                                <i className="fas fa-layer-group"></i>
                            </div>
                            <div className="cm-stat-info">
                                <h4 className="cm-stat-number">{stats.total}</h4>
                                <p className="cm-stat-label">Total Kategori</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-lg-3 col-md-6 mb-3">
                    <div className="cm-stat-card stat-success">
                        <div className="cm-stat-card-body">
                            <div className="cm-stat-icon">
                                <i className="fas fa-check-circle"></i>
                            </div>
                            <div className="cm-stat-info">
                                <h4 className="cm-stat-number">{stats.active}</h4>
                                <p className="cm-stat-label">Aktif</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-lg-3 col-md-6 mb-3">
                    <div className="cm-stat-card stat-warning">
                        <div className="cm-stat-card-body">
                            <div className="cm-stat-icon">
                                <i className="fas fa-book"></i>
                            </div>
                            <div className="cm-stat-info">
                                <h4 className="cm-stat-number">{stats.withCourses}</h4>
                                <p className="cm-stat-label">Dengan Kursus</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-lg-3 col-md-6 mb-3">
                    <div className="cm-stat-card stat-info">
                        <div className="cm-stat-card-body">
                            <div className="cm-stat-icon">
                                <i className="fas fa-graduation-cap"></i>
                            </div>
                            <div className="cm-stat-info">
                                <h4 className="cm-stat-number">{stats.totalCourses}</h4>
                                <p className="cm-stat-label">Total Kursus</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search and Filter */}
            <div className="row mb-4">
                <div className="col-md-6">
                    <div className="input-group cm-search-input">
                        <span className="input-group-text bg-white border-end-0">
                            <i className="fas fa-search"></i>
                        </span>
                        <input
                            type="text"
                            className="form-control border-start-0"
                            placeholder="Cari kategori..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="col-md-6 text-end">
                    <span className="text-muted">
                        Menampilkan <strong>{filteredCategories.length}</strong> dari <strong>{categories.length}</strong> kategori
                    </span>
                </div>
            </div>

            {/* Categories List */}
            {loading ? (
                <div className="cm-card">
                    <div className="text-center py-5">
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Memuat...</span>
                        </div>
                        <p className="mt-3 text-muted">Memuat kategori...</p>
                    </div>
                </div>
            ) : filteredCategories.length === 0 ? (
                <div className="cm-card">
                    <div className="cm-empty-state">
                        <div className="cm-empty-state-icon">
                            <i className="fas fa-inbox"></i>
                        </div>
                        <h4>Kategori Tidak Ditemukan</h4>
                        <p className="text-muted">
                            {searchTerm ? "Pencarian Anda tidak cocok dengan kategori apapun" : "Buat kategori pertama Anda untuk memulai"}
                        </p>
                        {!searchTerm && (
                            <button 
                                className="btn btn-primary mt-3"
                                onClick={handleAddCategory}
                            >
                                <i className="fas fa-plus me-2"></i>Buat Kategori
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="cm-card">
                    <div className="cm-categories-table-responsive">
                        <table className="cm-categories-table">
                            <thead>
                                <tr>
                                    <th>Nama Kategori</th>
                                    <th>Status</th>
                                    <th>Kursus</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCategories.map(category => (
                                    <tr key={category.id}>
                                        <td>
                                            <div className="cm-category-row">
                                                {category.image && (
                                                    <img 
                                                        src={category.image} 
                                                        alt={category.title}
                                                        className="cm-category-image"
                                                        onError={(e) => {
                                                            e.target.style.display = "none";
                                                        }}
                                                    />
                                                )}
                                                <div>
                                                    <h6 className="mb-1">{category.title}</h6>
                                                    {category.slug && <small className="text-muted">Slug: {category.slug}</small>}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            {category.active ? (
                                                <span className="badge bg-success">
                                                    <i className="fas fa-check-circle me-1"></i>Aktif
                                                </span>
                                            ) : (
                                                <span className="badge bg-secondary">
                                                    <i className="fas fa-times-circle me-1"></i>Tidak Aktif
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <span className="badge bg-info">
                                                <i className="fas fa-book me-1"></i>
                                                {category.course_count}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="cm-action-buttons">
                                                <button
                                                    className="btn btn-sm btn-primary"
                                                    onClick={() => handleEditCategory(category)}
                                                    title="Edit kategori"
                                                >
                                                    <i className="fas fa-edit"></i>
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() => handleDeleteCategoryClick(category)}
                                                    disabled={category.course_count > 0}
                                                    title={category.course_count > 0 ? "Tidak dapat menghapus kategori yang memiliki kursus" : "Hapus kategori"}
                                                >
                                                    <i className="fas fa-trash"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            </>
            )}

            {/* TAGS SECTION */}
            {activeTab === 'tags' && (
            <>
            <div className="row mb-4">
                <div className="col-lg-3 col-md-6 mb-3">
                    <div className="cm-stat-card stat-primary">
                        <div className="cm-stat-card-body">
                            <div className="cm-stat-icon">
                                <i className="fas fa-tags"></i>
                            </div>
                            <div className="cm-stat-info">
                                <h4 className="cm-stat-number">{tagStats.total}</h4>
                                <p className="cm-stat-label">Total Tag</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-lg-3 col-md-6 mb-3">
                    <div className="cm-stat-card stat-success">
                        <div className="cm-stat-card-body">
                            <div className="cm-stat-icon">
                                <i className="fas fa-check-circle"></i>
                            </div>
                            <div className="cm-stat-info">
                                <h4 className="cm-stat-number">{tagStats.active}</h4>
                                <p className="cm-stat-label">Aktif</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-lg-3 col-md-6 mb-3">
                    <div className="cm-stat-card stat-warning">
                        <div className="cm-stat-card-body">
                            <div className="cm-stat-icon">
                                <i className="fas fa-book"></i>
                            </div>
                            <div className="cm-stat-info">
                                <h4 className="cm-stat-number">{tagStats.withCourses}</h4>
                                <p className="cm-stat-label">Dengan Kursus</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-lg-3 col-md-6 mb-3">
                    <div className="cm-stat-card stat-info">
                        <div className="cm-stat-card-body">
                            <div className="cm-stat-icon">
                                <i className="fas fa-graduation-cap"></i>
                            </div>
                            <div className="cm-stat-info">
                                <h4 className="cm-stat-number">{tagStats.totalCourses}</h4>
                                <p className="cm-stat-label">Total Kursus</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search and Filter for Tags */}
            <div className="row mb-4">
                <div className="col-md-6">
                    <div className="input-group cm-search-input">
                        <span className="input-group-text bg-white border-end-0">
                            <i className="fas fa-search"></i>
                        </span>
                        <input
                            type="text"
                            className="form-control border-start-0"
                            placeholder="Cari tag..."
                            value={tagSearchTerm}
                            onChange={(e) => setTagSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="col-md-6 text-end">
                    <span className="text-muted">
                        Menampilkan <strong>{filteredTags.length}</strong> dari <strong>{tags.length}</strong> tag
                    </span>
                </div>
            </div>

            {/* Tags List */}
            {tagsLoading ? (
                <div className="cm-card">
                    <div className="text-center py-5">
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Memuat...</span>
                        </div>
                        <p className="mt-3 text-muted">Memuat tag...</p>
                    </div>
                </div>
            ) : filteredTags.length === 0 ? (
                <div className="cm-card">
                    <div className="cm-empty-state">
                        <div className="cm-empty-state-icon">
                            <i className="fas fa-inbox"></i>
                        </div>
                        <h4>Tag Tidak Ditemukan</h4>
                        <p className="text-muted">
                            {tagSearchTerm ? "Pencarian Anda tidak cocok dengan tag apapun" : "Buat tag pertama Anda untuk memulai"}
                        </p>
                        {!tagSearchTerm && (
                            <button 
                                className="btn btn-primary mt-3"
                                onClick={handleAddTag}
                            >
                                <i className="fas fa-plus me-2"></i>Buat Tag
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="cm-card">
                    <div className="cm-tags-table-responsive">
                        <table className="cm-tags-table">
                            <thead>
                                <tr>
                                    <th>Nama Tag</th>
                                    <th>Status</th>
                                    <th>Kursus</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTags.map(tag => (
                                    <tr key={tag.id}>
                                        <td>
                                            <div className="cm-tag-row">
                                                <h6 className="mb-1">{tag.title}</h6>
                                                {tag.slug && <small className="text-muted">Slug: {tag.slug}</small>}
                                            </div>
                                        </td>
                                        <td>
                                            {tag.active ? (
                                                <span className="badge bg-success">
                                                    <i className="fas fa-check-circle me-1"></i>Aktif
                                                </span>
                                            ) : (
                                                <span className="badge bg-secondary">
                                                    <i className="fas fa-times-circle me-1"></i>Tidak Aktif
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <span className="badge bg-info">
                                                <i className="fas fa-book me-1"></i>
                                                {tag.course_count}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="cm-action-buttons">
                                                <button
                                                    className="btn btn-sm btn-primary"
                                                    onClick={() => handleEditTag(tag)}
                                                    title="Edit tag"
                                                >
                                                    <i className="fas fa-edit"></i>
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() => handleDeleteTagClick(tag)}
                                                    disabled={tag.course_count > 0}
                                                    title={tag.course_count > 0 ? "Tidak dapat menghapus tag yang memiliki kursus" : "Hapus tag"}
                                                >
                                                    <i className="fas fa-trash"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            </>
            )}

            {/* Add/Edit Category Modal */}
            {showModal && (
                <div className="cm-modal-overlay cm-modal-show" onClick={() => setShowModal(false)}>
                    <div className="cm-modal cm-modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="cm-modal-header">
                            <h5 className="modal-title">
                                <i className={`fas fa-${modalMode === "add" ? "plus-circle" : "edit"} me-2`}></i>
                                {modalMode === "add" ? "Tambah Kategori Baru" : "Edit Kategori"}
                            </h5>
                            <button
                                type="button"
                                className="btn-close"
                                onClick={() => setShowModal(false)}
                            ></button>
                        </div>
                        <div className="cm-modal-body">
                            {formErrors.submit && (
                                <div className="alert alert-danger alert-dismissible fade show" role="alert">
                                    <i className="fas fa-exclamation-circle me-2"></i>
                                    {formErrors.submit}
                                    <button type="button" className="btn-close" onClick={() => setFormErrors({...formErrors, submit: ""})}></button>
                                </div>
                            )}
                            
                            <div className="mb-4">
                                <label htmlFor="categoryTitle" className="form-label">
                                    Nama Kategori <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="categoryTitle"
                                    className={`form-control ${formErrors.title ? "is-invalid" : ""}`}
                                    name="title"
                                    value={formData.title}
                                    onChange={handleFormChange}
                                    placeholder="Misalnya, Pemrograman, Desain, Bisnis"
                                />
                                {formErrors.title && (
                                    <div className="invalid-feedback d-block">
                                        <i className="fas fa-times-circle me-1"></i>{formErrors.title}
                                    </div>
                                )}
                            </div>

                            <div className="mb-4">
                                <label htmlFor="categoryImage" className="form-label">
                                    URL Gambar
                                </label>
                                <input
                                    type="url"
                                    id="categoryImage"
                                    className="form-control"
                                    name="image"
                                    value={formData.image}
                                    onChange={handleFormChange}
                                    placeholder="https://contoh.com/gambar.jpg"
                                />
                                <small className="text-muted d-block mt-2">
                                    <i className="fas fa-info-circle me-1"></i>
                                    Masukkan URL lengkap ke file gambar (JPG, PNG, GIF)
                                </small>
                                {formData.image && (
                                    <div className="mt-3">
                                        <img
                                            src={formData.image}
                                            alt="Preview"
                                            className="img-thumbnail"
                                            style={{ maxHeight: "150px", maxWidth: "100%" }}
                                            onError={() => null}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="form-check modern-form-check">
                                <input
                                    type="checkbox"
                                    id="categoryActive"
                                    className="form-check-input"
                                    name="active"
                                    checked={formData.active}
                                    onChange={handleFormChange}
                                />
                                <label className="form-check-label" htmlFor="categoryActive">
                                    Buat kategori ini terlihat di platform
                                </label>
                            </div>
                        </div>
                        <div className="cm-modal-footer">
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => setShowModal(false)}
                            >
                                <i className="fas fa-times me-2"></i>Batal
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleSaveCategory}
                            >
                                <i className={`fas fa-${modalMode === "add" ? "check" : "save"} me-2`}></i>
                                {modalMode === "add" ? "Buat Kategori" : "Simpan Perubahan"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Tag Modal */}
            {showTagsModal && (
                <div className="cm-modal-overlay cm-modal-show" onClick={() => setShowTagsModal(false)}>
                    <div className="cm-modal cm-modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="cm-modal-header">
                            <h5 className="modal-title">
                                <i className={`fas fa-${tagModalMode === "add" ? "plus-circle" : "edit"} me-2`}></i>
                                {tagModalMode === "add" ? "Tambah Tag Baru" : "Edit Tag"}
                            </h5>
                            <button
                                type="button"
                                className="btn-close"
                                onClick={() => setShowTagsModal(false)}
                            ></button>
                        </div>
                        <div className="cm-modal-body">
                            {tagFormErrors.submit && (
                                <div className="alert alert-danger alert-dismissible fade show" role="alert">
                                    <i className="fas fa-exclamation-circle me-2"></i>
                                    {tagFormErrors.submit}
                                    <button type="button" className="btn-close" onClick={() => setTagFormErrors({...tagFormErrors, submit: ""})}></button>
                                </div>
                            )}
                            
                            <div className="mb-4">
                                <label htmlFor="tagTitle" className="form-label">
                                    Nama Tag <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="tagTitle"
                                    className={`form-control ${tagFormErrors.title ? "is-invalid" : ""}`}
                                    name="title"
                                    value={tagFormData.title}
                                    onChange={handleTagFormChange}
                                    placeholder="Misalnya, Python, Web Development, Mobile App"
                                />
                                {tagFormErrors.title && (
                                    <div className="invalid-feedback d-block">
                                        <i className="fas fa-times-circle me-1"></i>{tagFormErrors.title}
                                    </div>
                                )}
                            </div>

                            <div className="mb-4">
                                <div className="form-check">
                                    <input
                                        type="checkbox"
                                        id="tagActive"
                                        className="form-check-input"
                                        name="active"
                                        checked={tagFormData.active}
                                        onChange={handleTagFormChange}
                                    />
                                    <label className="form-check-label" htmlFor="tagActive">
                                        Buat tag ini terlihat di platform
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="cm-modal-footer">
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => setShowTagsModal(false)}
                            >
                                <i className="fas fa-times me-2"></i>Batal
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleSaveTag}
                            >
                                <i className={`fas fa-${tagModalMode === "add" ? "check" : "save"} me-2`}></i>
                                {tagModalMode === "add" ? "Buat Tag" : "Simpan Perubahan"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && deleteTarget && (
                <div className="cm-modal-overlay cm-modal-show" onClick={() => !isDeleting && setShowDeleteConfirm(false)}>
                    <div className="cm-modal" style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="cm-modal-header" style={{ borderBottom: '2px solid #fee2e2', background: '#fef2f2' }}>
                            <h5 className="modal-title" style={{ color: '#dc2626' }}>
                                <i className="fas fa-trash-alt me-2"></i>
                                Konfirmasi Penghapusan
                            </h5>
                            <button
                                type="button"
                                className="btn-close"
                                onClick={() => !isDeleting && setShowDeleteConfirm(false)}
                                disabled={isDeleting}
                            ></button>
                        </div>
                        <div className="cm-modal-body" style={{ paddingTop: '25px', paddingBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px', marginBottom: '20px' }}>
                                <div style={{
                                    width: '50px',
                                    height: '50px',
                                    borderRadius: '50%',
                                    background: '#fee2e2',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <i className="fas fa-exclamation-triangle" style={{ fontSize: '24px', color: '#dc2626' }}></i>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ margin: 0, marginBottom: '8px', fontWeight: 600, color: '#1a1a1a', fontSize: '1rem' }}>
                                        Anda akan menghapus {deleteTargetType === 'category' ? 'kategori' : 'tag'} ini secara permanen
                                    </p>
                                    <p style={{ margin: 0, color: '#666', fontSize: '0.9rem', lineHeight: '1.5' }}>
                                        <strong style={{ color: '#1a1a1a' }}>"{deleteTarget.title}"</strong>
                                    </p>
                                </div>
                            </div>
                            <div style={{
                                padding: '12px 15px',
                                background: '#fef2f2',
                                borderLeft: '3px solid #dc2626',
                                borderRadius: '4px',
                                marginBottom: '10px'
                            }}>
                                <p style={{ margin: 0, color: '#991b1b', fontSize: '0.85rem', fontWeight: 500 }}>
                                    <i className="fas fa-info-circle me-2"></i>
                                    Tindakan ini tidak dapat dibatalkan. Pastikan Anda benar-benar ingin menghapus {deleteTargetType === 'category' ? 'kategori' : 'tag'} ini.
                                </p>
                            </div>
                        </div>
                        <div className="cm-modal-footer">
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isDeleting}
                            >
                                <i className="fas fa-times me-2"></i>Batal
                            </button>
                            <button
                                type="button"
                                className="btn btn-danger"
                                onClick={() => {
                                    if (deleteTargetType === 'category') {
                                        handleDeleteCategory(deleteTarget);
                                    } else {
                                        handleDeleteTag(deleteTarget);
                                    }
                                }}
                                disabled={isDeleting}
                                style={{ position: 'relative' }}
                            >
                                {isDeleting ? (
                                    <>
                                        <i className="fas fa-spinner fa-spin me-2"></i>
                                        Menghapus...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-trash-alt me-2"></i>
                                        Ya, Hapus {deleteTargetType === 'category' ? 'Kategori' : 'Tag'}
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
