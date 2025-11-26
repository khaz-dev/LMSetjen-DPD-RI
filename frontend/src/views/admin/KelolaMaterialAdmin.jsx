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
            setCategories(response.data || []);
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

            let response;
            if (modalMode === "add") {
                response = await apiInstance.post("admin/category/", payload);
                Toast().fire({
                    icon: "success",
                    title: "Category created successfully"
                });
            } else {
                response = await apiInstance.put(`admin/category/${selectedCategory.id}/`, payload);
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
            await apiInstance.delete(`admin/category/${category.id}/`);
            Toast().fire({
                icon: "success",
                title: "Category deleted successfully"
            });
            fetchCategories();
        } catch (error) {
            console.error("Error deleting category:", error);
            const errorMsg = error.response?.data?.error || "Failed to delete category";
            Toast().fire({
                icon: "error",
                title: errorMsg
            });
        }
    };

    const filteredCategories = categories.filter(cat =>
        cat.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isAdmin) {
        return (
            <div className="kelola-materi-page">
                <AdminHeader />
                <div className="container mt-5">
                    <div className="alert alert-danger">
                        <i className="fas fa-lock me-2"></i>
                        You do not have permission to access this page
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="kelola-materi-page">
            <AdminHeader />

            <div className="container-fluid py-4 mt-5">
                <div className="kelola-materi-header mb-4">
                    <div className="row align-items-center">
                        <div className="col-md-8">
                            <div>
                                <h1 className="kelola-materi-title">
                                    <i className="fas fa-book me-3"></i>Kelola Materi (Manage Categories)
                                </h1>
                                <p className="kelola-materi-subtitle text-muted">
                                    Manage course categories - Create, edit, and remove categories
                                </p>
                            </div>
                        </div>
                        <div className="col-md-4 text-end">
                            <button 
                                className="btn btn-primary btn-lg"
                                onClick={handleAddCategory}
                            >
                                <i className="fas fa-plus me-2"></i>Add Category
                            </button>
                        </div>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="row mb-4">
                    <div className="col-md-6">
                        <div className="input-group">
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
                </div>

                {/* Categories List */}
                {loading ? (
                    <div className="text-center py-5">
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                    </div>
                ) : filteredCategories.length === 0 ? (
                    <div className="alert alert-info">
                        <i className="fas fa-info-circle me-2"></i>
                        {searchTerm ? "No categories found matching your search" : "No categories yet. Create one to get started!"}
                    </div>
                ) : (
                    <div className="categories-container">
                        <div className="row">
                            {filteredCategories.map(category => (
                                <div key={category.id} className="col-lg-6 col-xl-4 mb-4">
                                    <div className="category-card">
                                        <div className="category-card-header">
                                            {category.image && (
                                                <img 
                                                    src={category.image} 
                                                    alt={category.title}
                                                    className="category-image"
                                                    onError={(e) => {
                                                        e.target.style.display = "none";
                                                    }}
                                                />
                                            )}
                                            {!category.image && (
                                                <div className="category-image-placeholder">
                                                    <i className="fas fa-image"></i>
                                                </div>
                                            )}
                                        </div>
                                        <div className="category-card-body">
                                            <h5 className="category-title">{category.title}</h5>
                                            <div className="category-meta">
                                                <span className="badge bg-info">
                                                    <i className="fas fa-graduation-cap me-1"></i>
                                                    {category.course_count} course{category.course_count !== 1 ? "s" : ""}
                                                </span>
                                                {category.active ? (
                                                    <span className="badge bg-success">
                                                        <i className="fas fa-check-circle me-1"></i>Active
                                                    </span>
                                                ) : (
                                                    <span className="badge bg-danger">
                                                        <i className="fas fa-times-circle me-1"></i>Inactive
                                                    </span>
                                                )}
                                            </div>
                                            {category.slug && (
                                                <p className="category-slug text-muted small mt-2">
                                                    Slug: <code>{category.slug}</code>
                                                </p>
                                            )}
                                        </div>
                                        <div className="category-card-footer">
                                            <button
                                                className="btn btn-sm btn-outline-primary"
                                                onClick={() => handleEditCategory(category)}
                                            >
                                                <i className="fas fa-edit me-1"></i>Edit
                                            </button>
                                            <button
                                                className="btn btn-sm btn-outline-danger"
                                                onClick={() => handleDeleteCategory(category)}
                                                disabled={category.course_count > 0}
                                                title={category.course_count > 0 ? "Cannot delete category with courses" : "Delete category"}
                                            >
                                                <i className="fas fa-trash me-1"></i>Remove
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Add/Edit Category Modal */}
            {showModal && (
                <div className="modal show d-block" style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">
                                    {modalMode === "add" ? "Add New Category" : "Edit Category"}
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setShowModal(false)}
                                ></button>
                            </div>
                            <div className="modal-body">
                                {formErrors.submit && (
                                    <div className="alert alert-danger" role="alert">
                                        {formErrors.submit}
                                    </div>
                                )}
                                
                                <div className="mb-3">
                                    <label htmlFor="categoryTitle" className="form-label">
                                        Category Name <span className="text-danger">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="categoryTitle"
                                        className={`form-control ${formErrors.title ? "is-invalid" : ""}`}
                                        name="title"
                                        value={formData.title}
                                        onChange={handleFormChange}
                                        placeholder="Enter category name"
                                    />
                                    {formErrors.title && (
                                        <div className="invalid-feedback d-block">
                                            {formErrors.title}
                                        </div>
                                    )}
                                </div>

                                <div className="mb-3">
                                    <label htmlFor="categoryImage" className="form-label">
                                        Image URL
                                    </label>
                                    <input
                                        type="url"
                                        id="categoryImage"
                                        className="form-control"
                                        name="image"
                                        value={formData.image}
                                        onChange={handleFormChange}
                                        placeholder="https://example.com/image.jpg"
                                    />
                                    <small className="text-muted">
                                        <i className="fas fa-info-circle me-1"></i>
                                        Enter a full URL to an image file
                                    </small>
                                    {formData.image && (
                                        <div className="mt-2">
                                            <img
                                                src={formData.image}
                                                alt="Preview"
                                                className="img-thumbnail"
                                                style={{ maxHeight: "150px" }}
                                                onError={() => null}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="mb-3">
                                    <div className="form-check">
                                        <input
                                            type="checkbox"
                                            id="categoryActive"
                                            className="form-check-input"
                                            name="active"
                                            checked={formData.active}
                                            onChange={handleFormChange}
                                        />
                                        <label className="form-check-label" htmlFor="categoryActive">
                                            Active (Visible on platform)
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleSaveCategory}
                                >
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
