import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import useAxios from "../../../utils/useAxios";
import Toast from "../../plugin/Toast";
import FormField from "./FormField";

/**
 * ✨ PHASE 4.45: CourseRequirementsForm Component
 * Allows instructors to manage course requirements/prerequisites
 */
function CourseRequirementsForm({ courseId, onRequirementsUpdate }) {
    // ✨ PHASE 4.177: Fetch guard to prevent duplicate API calls
    const hasFetchedRef = React.useRef(false);
    const [requirements, setRequirements] = useState([]);
    const [newRequirement, setNewRequirement] = useState({
        requirement: "",
    });
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [editingId, setEditingId] = useState(null);

    const API_BASE = `teacher/course-requirements/${courseId}`;

    // Load existing requirements
    // ✨ PHASE 4.177: Add fetch guard to prevent duplicate calls on re-render
    useEffect(() => {
        if (courseId && !hasFetchedRef.current) {
            hasFetchedRef.current = true;
            loadRequirements();
        }
    }, [courseId]);

    const loadRequirements = async () => {
        try {
            setLoading(true);
            const response = await useAxios.get(API_BASE + "/");
            setRequirements(response.data?.results || response.data || []);
        } catch (error) {
            console.error("Error loading requirements:", error);
            Toast("error", "Gagal memuat persyaratan kursus");
        } finally {
            setLoading(false);
        }
    };

    const validateRequirement = () => {
        const newErrors = {};
        if (!newRequirement.requirement?.trim()) {
            newErrors.requirement = ["Deskripsi persyaratan tidak boleh kosong"];
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleAddRequirement = async () => {
        if (!validateRequirement()) return;

        try {
            setLoading(true);
            const payload = {
                requirement: newRequirement.requirement,
            };

            if (editingId) {
                // Update existing requirement
                await useAxios.patch(API_BASE + `/${editingId}/`, payload);
                setEditingId(null);
            } else {
                // Create new requirement
                const response = await useAxios.post(API_BASE + "/", payload);
            }

            // Reset form and reload requirements
            setNewRequirement({ requirement: "" });
            setErrors({});
            loadRequirements();
            
            if (onRequirementsUpdate) {
                onRequirementsUpdate();
            }
        } catch (error) {
            console.error("Error saving requirement:", error);
            const errorData = error.response?.data || {};
            setErrors(errorData);
            Toast("error", "Gagal menyimpan persyaratan");
        } finally {
            setLoading(false);
        }
    };

    const handleEditRequirement = (requirement) => {
        setNewRequirement({
            requirement: requirement.requirement,
        });
        setEditingId(requirement.id);
        setErrors({});
    };

    const handleDeleteRequirement = async (requirementId) => {
        // ✨ PHASE 4.48: Use SweetAlert2 for better delete confirmation UX
        const result = await Swal.fire({
            title: 'Hapus Persyaratan?',
            text: 'Persyaratan ini akan dihapus secara permanen dari kursus Anda.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Ya, hapus!',
            cancelButtonText: 'Batal',
            allowOutsideClick: false,
            allowEscapeKey: false
        });

        if (!result.isConfirmed) return;

        try {
            setLoading(true);
            await useAxios.delete(`${API_BASE}/${requirementId}/`);
            loadRequirements();
            
            Toast().fire({
                icon: 'success',
                title: 'Persyaratan Dihapus',
                text: 'Persyaratan telah berhasil dihapus dari kursus Anda.',
                timer: 2000,
                timerProgressBar: true,
                showConfirmButton: false
            });
            
            if (onRequirementsUpdate) {
                onRequirementsUpdate();
            }
        } catch (error) {
            console.error("Error deleting requirement:", error);
            Toast().fire({
                icon: 'error',
                title: 'Gagal Menghapus',
                text: 'Terjadi kesalahan saat menghapus persyaratan. Silakan coba lagi.',
                timer: 3000,
                timerProgressBar: true,
                showConfirmButton: false
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setNewRequirement({ requirement: "" });
        setEditingId(null);
        setErrors({});
    };

    return (
        <div className="form-section">
            <h5 className="section-title mb-3">
                <i className="fas fa-tasks me-2"></i>
                Persyaratan
            </h5>

            {/* Requirements List */}
            {requirements.length > 0 && (
                <div className="mb-4">
                    <ol className="list-group list-group-numbered">
                        {requirements.map((requirement, index) => (
                            <li
                                key={requirement.id}
                                className="list-group-item d-flex justify-content-between align-items-center"
                            >
                                <div className="flex-grow-1">
                                    <p className="mb-0">{requirement.requirement}</p>
                                </div>
                                <div className="btn-group" role="group">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-primary"
                                        onClick={() => handleEditRequirement(requirement)}
                                        disabled={loading}
                                    >
                                        <i className="fas fa-edit"></i>
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-danger"
                                        onClick={() => handleDeleteRequirement(requirement.id)}
                                        disabled={loading}
                                    >
                                        <i className="fas fa-trash"></i>
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            )}

            {/* Add Requirement Form */}
            <div className="card border-light mb-3">
                <div className="card-body">
                    <h6 className="mb-3">
                        {editingId ? "Edit Persyaratan" : "Tambah Persyaratan Baru"}
                    </h6>

                    <div className="row">
                        <div className="col-12">
                            <FormField
                                label="Deskripsi Persyaratan"
                                name="requirement"
                                type="text"
                                value={newRequirement.requirement}
                                onChange={(e) => {
                                    setNewRequirement({
                                        ...newRequirement,
                                        requirement: e.target.value,
                                    });
                                }}
                                placeholder="Contoh: Komputer dengan koneksi internet"
                                errors={errors.requirement || []}
                                required
                            />
                        </div>
                    </div>

                    <div className="mt-3 d-flex gap-2">
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleAddRequirement}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" />
                                    Menyimpan...
                                </>
                            ) : editingId ? (
                                <>
                                    <i className="fas fa-save me-2"></i>
                                    Perbarui Persyaratan
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-plus me-2"></i>
                                    Tambah Persyaratan
                                </>
                            )}
                        </button>

                        {editingId && (
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleCancel}
                                disabled={loading}
                            >
                                Batal
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {requirements.length === 0 && !loading && (
                <div className="alert alert-info">
                    <i className="fas fa-info-circle me-2"></i>
                    Belum ada persyaratan yang ditambahkan. Tentukan persyaratan untuk
                    peserta didik di atas.
                </div>
            )}
        </div>
    );
}

// ✨ PHASE 4.177: Memoize component to prevent unnecessary re-renders from parent
export default React.memo(CourseRequirementsForm);
