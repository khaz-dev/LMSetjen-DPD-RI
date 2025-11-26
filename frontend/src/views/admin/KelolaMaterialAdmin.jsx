import React, { useState, useEffect } from "react";
import AdminHeader from "../partials/AdminHeader";
import Footer from "../partials/Footer";
import apiInstance from "../../utils/axios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import "./KelolaMaterialAdmin.css";

function KelolaMaterialAdmin() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState("add"); // 'add' or 'edit'
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [formData, setFormData] = useState({ title: "", image: "", active: true });
    const [formErrors, setFormErrors] = useState({});
    const [searchTerm, setSearchTerm] = useState("");

    const userData = UserData();
    const isAdmin = userData?.role === "admin";

    useEffect(() => {
        if (isAdmin) {
            fetchCategories();
        }
    }, [isAdmin]);

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
                title: "Failed to load categories"
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
            errors.title = "Category name is required";
        }
        if (formData.title.trim().length < 2) {
            errors.title = "Category name must be at least 2 characters";
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
                    title: "Category created successfully"
                });
            } else {
                await apiInstance.put(`admin/category/${selectedCategory.id}/`, payload);
                Toast().fire({
                    icon: "success",
                    title: "Category updated successfully"
                });
            }

            setShowModal(false);
            setFormData({ title: "", image: "", active: true });
            fetchCategories();
        } catch (error) {
            console.error("Error saving category:", error);
            const errorMsg = error.response?.data?.title?.[0] || error.response?.data?.error || "Failed to save category";
            setFormErrors({ submit: errorMsg });
            Toast().fire({
                icon: "error",
                title: errorMsg
            });
        }
    };

    const handleDeleteCategory = async (category) => {
        if (!window.confirm(`Are you sure you want to delete "${category.title}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await apiInstance.delete(`admin/category/${category.id}/`);
            
            // Handle both 200 OK and 204 NO_CONTENT responses
            if (response.status === 204 || response.status === 200) {
                Toast().fire({
                    icon: "success",
                    title: "Category deleted successfully"
                });
                fetchCategories();
            }
        } catch (error) {
            console.error("Error deleting category:", error);
            
            // Handle different error scenarios
            if (error.response?.status === 400) {
                // Category has courses
                const errorMsg = error.response?.data?.error || "Cannot delete category with courses";
                Toast().fire({
                    icon: "warning",
                    title: errorMsg
                });
            } else if (error.response?.status === 404) {
                Toast().fire({
                    icon: "error",
                    title: "Category not found"
                });
                fetchCategories();
            } else if (error.response?.status === 403) {
                Toast().fire({
                    icon: "error",
                    title: "You do not have permission to delete this category"
                });
            } else {
                const errorMsg = error.response?.data?.error || error.response?.data?.detail || "Failed to delete category";
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

    if (!isAdmin) {
        return (
            <>
                <AdminHeader />
                <div className="container mt-5">
                    <div className="alert alert-danger">
                        <i className="fas fa-lock me-2"></i>
                        You do not have permission to access this page
                    </div>
                </div>
                <Footer />
            </>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
            <AdminHeader />

            <section className="pt-5 pb-5 modern-dashboard" style={{ flex: 1 }}>
                <div className="container">
                    {/* Modern Header */}
                    <div className="dashboard-header-modern mb-4">
                        <div className="header-content">
                            <div className="header-text">
                                <h1 className="dashboard-title">
                                    <i className="fas fa-book-atlas me-3"></i>Kelola Materi
                                </h1>
                                <p className="dashboard-subtitle">
                                    Manage course categories with full control over content organization
                                </p>
                            </div>
                            <div className="dashboard-actions">
                                <button 
                                    className="btn btn-primary"
                                    onClick={handleAddCategory}
                                >
                                    <i className="fas fa-plus me-2"></i>Add Category
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Statistics Cards */}
                    <div className="row mb-4">
                        <div className="col-lg-3 col-md-6 mb-3">
                            <div className="stat-card stat-card-primary">
                                <div className="stat-card-body">
                                    <div className="stat-icon">
                                        <i className="fas fa-layer-group"></i>
                                    </div>
                                    <div className="stat-info">
                                        <h4 className="stat-number">{stats.total}</h4>
                                        <p className="stat-label">Total Categories</p>
                                        <span className="stat-change neutral">All categories</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-lg-3 col-md-6 mb-3">
                            <div className="stat-card stat-card-success">
                                <div className="stat-card-body">
                                    <div className="stat-icon">
                                        <i className="fas fa-check-circle"></i>
                                    </div>
                                    <div className="stat-info">
                                        <h4 className="stat-number">{stats.active}</h4>
                                        <p className="stat-label">Active</p>
                                        <span className="stat-change positive">Visible</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-lg-3 col-md-6 mb-3">
                            <div className="stat-card stat-card-warning">
                                <div className="stat-card-body">
                                    <div className="stat-icon">
                                        <i className="fas fa-book"></i>
                                    </div>
                                    <div className="stat-info">
                                        <h4 className="stat-number">{stats.withCourses}</h4>
                                        <p className="stat-label">With Courses</p>
                                        <span className="stat-change neutral">{stats.totalCourses} courses</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-lg-3 col-md-6 mb-3">
                            <div className="stat-card stat-card-info">
                                <div className="stat-card-body">
                                    <div className="stat-icon">
                                        <i className="fas fa-graduation-cap"></i>
                                    </div>
                                    <div className="stat-info">
                                        <h4 className="stat-number">{stats.totalCourses}</h4>
                                        <p className="stat-label">Total Courses</p>
                                        <span className="stat-change neutral">Assigned</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Search and Filter */}
                    <div className="row mb-4">
                        <div className="col-md-6">
                            <div className="input-group search-input-group">
                                <span className="input-group-text bg-white border-end-0">
                                    <i className="fas fa-search"></i>
                                </span>
                                <input
                                    type="text"
                                    className="form-control border-start-0"
                                    placeholder="Search categories..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="col-md-6 text-end">
                            <span className="text-muted">
                                Showing <strong>{filteredCategories.length}</strong> of <strong>{categories.length}</strong> categories
                            </span>
                        </div>
                    </div>

                    {/* Categories List */}
                    {loading ? (
                        <div className="activity-panel">
                            <div className="text-center py-5">
                                <div className="spinner-border text-primary" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                                <p className="mt-3 text-muted">Loading categories...</p>
                            </div>
                        </div>
                    ) : filteredCategories.length === 0 ? (
                        <div className="activity-panel">
                            <div className="empty-state">
                                <div className="empty-state-icon">
                                    <i className="fas fa-inbox"></i>
                                </div>
                                <h4>No Categories Found</h4>
                                <p className="text-muted">
                                    {searchTerm ? "Your search didn't match any categories" : "Create your first category to get started"}
                                </p>
                                {!searchTerm && (
                                    <button 
                                        className="btn btn-primary mt-3"
                                        onClick={handleAddCategory}
                                    >
                                        <i className="fas fa-plus me-2"></i>Create Category
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="activity-panel">
                            <div className="categories-table-responsive">
                                <table className="categories-table">
                                    <thead>
                                        <tr>
                                            <th>Category Name</th>
                                            <th>Status</th>
                                            <th>Courses</th>
                                            <th className="text-end">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredCategories.map(category => (
                                            <tr key={category.id}>
                                                <td>
                                                    <div className="category-row-content">
                                                        {category.image && (
                                                            <img 
                                                                src={category.image} 
                                                                alt={category.title}
                                                                className="category-row-image"
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
                                                            <i className="fas fa-check-circle me-1"></i>Active
                                                        </span>
                                                    ) : (
                                                        <span className="badge bg-secondary">
                                                            <i className="fas fa-times-circle me-1"></i>Inactive
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
                                                    <div className="action-buttons">
                                                        <button
                                                            className="btn btn-sm btn-outline-primary action-btn"
                                                            onClick={() => handleEditCategory(category)}
                                                            title="Edit category"
                                                        >
                                                            <i className="fas fa-edit"></i>
                                                        </button>
                                                        <button
                                                            className="btn btn-sm btn-outline-danger action-btn"
                                                            onClick={() => handleDeleteCategory(category)}
                                                            disabled={category.course_count > 0}
                                                            title={category.course_count > 0 ? "Cannot delete category with courses" : "Delete category"}
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
                </div>
            </section>

            {/* Add/Edit Category Modal */}
            {showModal && (
                <div className="modal show d-block modern-modal" style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header modern-modal-header">
                                <h5 className="modal-title">
                                    <i className={`fas fa-${modalMode === "add" ? "plus-circle" : "edit"} me-2`}></i>
                                    {modalMode === "add" ? "Add New Category" : "Edit Category"}
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setShowModal(false)}
                                ></button>
                            </div>
                            <div className="modal-body modern-modal-body">
                                {formErrors.submit && (
                                    <div className="alert alert-danger alert-dismissible fade show" role="alert">
                                        <i className="fas fa-exclamation-circle me-2"></i>
                                        {formErrors.submit}
                                        <button type="button" className="btn-close" onClick={() => setFormErrors({...formErrors, submit: ""})}></button>
                                    </div>
                                )}
                                
                                <div className="mb-4">
                                    <label htmlFor="categoryTitle" className="form-label modern-form-label">
                                        Category Name <span className="text-danger">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="categoryTitle"
                                        className={`form-control modern-form-control ${formErrors.title ? "is-invalid" : ""}`}
                                        name="title"
                                        value={formData.title}
                                        onChange={handleFormChange}
                                        placeholder="e.g., Programming, Design, Business"
                                    />
                                    {formErrors.title && (
                                        <div className="invalid-feedback d-block">
                                            <i className="fas fa-times-circle me-1"></i>{formErrors.title}
                                        </div>
                                    )}
                                </div>

                                <div className="mb-4">
                                    <label htmlFor="categoryImage" className="form-label modern-form-label">
                                        Image URL
                                    </label>
                                    <input
                                        type="url"
                                        id="categoryImage"
                                        className="form-control modern-form-control"
                                        name="image"
                                        value={formData.image}
                                        onChange={handleFormChange}
                                        placeholder="https://example.com/image.jpg"
                                    />
                                    <small className="text-muted d-block mt-2">
                                        <i className="fas fa-info-circle me-1"></i>
                                        Enter a full URL to an image file (JPG, PNG, GIF)
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

                                <div className="mb-3">
                                    <div className="form-check modern-form-check">
                                        <input
                                            type="checkbox"
                                            id="categoryActive"
                                            className="form-check-input"
                                            name="active"
                                            checked={formData.active}
                                            onChange={handleFormChange}
                                            style={{ cursor: "pointer" }}
                                        />
                                        <label className="form-check-label" htmlFor="categoryActive">
                                            <i className="fas fa-eye me-2"></i>
                                            Make this category visible on the platform
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer modern-modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    onClick={() => setShowModal(false)}
                                >
                                    <i className="fas fa-times me-2"></i>Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleSaveCategory}
                                >
                                    <i className={`fas fa-${modalMode === "add" ? "check" : "save"} me-2`}></i>
                                    {modalMode === "add" ? "Create Category" : "Save Changes"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
}

export default React.memo(KelolaMaterialAdmin);
