import React, { useState, useEffect } from "react";
import apiInstance from "../../../utils/axios";
import Toast from "../../plugin/Toast";

/**
 * Materials/Categories Tab Component
 * Handles CRUD operations for course categories
 * ✨ PHASE 4: Extracted from KelolaMaterialAdmin.jsx for merged Content Management
 */
function MaterialsTab() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState("add"); // 'add' or 'edit'
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [formData, setFormData] = useState({ title: "", image: "", active: true });
    const [formErrors, setFormErrors] = useState({});
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        fetchCategories();
    }, []);

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

    const handleDeleteCategory = async (category) => {
        if (!window.confirm(`Apakah Anda yakin ingin menghapus "${category.title}"? Tindakan ini tidak dapat dibatalkan.`)) {
            return;
        }

        try {
            const response = await apiInstance.delete(`admin/category/${category.id}/`);
            
            // Handle both 200 OK and 204 NO_CONTENT responses
            if (response.status === 204 || response.status === 200) {
                Toast().fire({
                    icon: "success",
                    title: "Kategori berhasil dihapus"
                });
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
        }
    };

    const filteredCategories = categories.filter(cat =>
        cat.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Calculate stats
    const stats = {
        total: categories.length,
        active: categories.filter(c => c.active).length,
        withCourses: categories.filter(c => c.course_count > 0).length,
        totalCourses: categories.reduce((sum, c) => sum + c.course_count, 0)
    };

    return (
        <div className="cm-tab-content cm-materials-tab">
            <div className="cm-tab-header d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h3 className="mb-1">
                        <i className="fas fa-book-atlas me-2"></i>
                        Kelola Materi
                    </h3>
                    <p className="text-muted small mb-0">Kelola kategori kursus dengan kontrol penuh atas organisasi konten</p>
                </div>
                <button 
                    className="btn btn-primary"
                    onClick={handleAddCategory}
                >
                    <i className="fas fa-plus me-2"></i>Tambah Kategori
                </button>
            </div>

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
                                    <th className="text-end">Aksi</th>
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
                                        <td className="text-end">
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
                                                    onClick={() => handleDeleteCategory(category)}
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
        </div>
    );
}

export default React.memo(MaterialsTab);
