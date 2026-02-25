import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import useAxios from "../../../utils/useAxios";
import Toast from "../../plugin/Toast";
import FormField from "./FormField";

/**
 * ✨ PHASE 4.45: CourseLearningOutcomesForm Component
 * Allows instructors to manage course learning outcomes (what students will learn)
 */
function CourseLearningOutcomesForm({ courseId, onOutcomesUpdate }) {
    // ✨ PHASE 4.177: Fetch guard to prevent duplicate API calls
    const hasFetchedRef = React.useRef(false);
    const [outcomes, setOutcomes] = useState([]);
    const [newOutcome, setNewOutcome] = useState({
        outcome: "",
    });
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [editingId, setEditingId] = useState(null);

    const API_BASE = `teacher/course-learning-outcomes/${courseId}`;

    // Load existing learning outcomes
    // ✨ PHASE 4.177: Add fetch guard to prevent duplicate calls on re-render
    useEffect(() => {
        if (courseId && !hasFetchedRef.current) {
            hasFetchedRef.current = true;
            loadOutcomes();
        }
    }, [courseId]);

    const loadOutcomes = async () => {
        try {
            setLoading(true);
            const response = await useAxios.get(API_BASE + "/");
            setOutcomes(response.data?.results || response.data || []);
        } catch (error) {
            console.error("Error loading learning outcomes:", error);
            Toast("error", "Gagal memuat hasil pembelajaran");
        } finally {
            setLoading(false);
        }
    };

    const validateOutcome = () => {
        const newErrors = {};
        if (!newOutcome.outcome?.trim()) {
            newErrors.outcome = ["Deskripsi hasil pembelajaran tidak boleh kosong"];
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleAddOutcome = async () => {
        if (!validateOutcome()) return;

        try {
            setLoading(true);
            const payload = {
                outcome: newOutcome.outcome,
            };

            if (editingId) {
                // Update existing outcome
                await useAxios.patch(API_BASE + `/${editingId}/`, payload);
                setEditingId(null);
            } else {
                // Create new outcome
                const response = await useAxios.post(API_BASE + "/", payload);
            }

            // Reset form and reload outcomes
            setNewOutcome({ outcome: "" });
            setErrors({});
            loadOutcomes();
            
            if (onOutcomesUpdate) {
                onOutcomesUpdate();
            }
        } catch (error) {
            console.error("Error saving learning outcome:", error);
            const errorData = error.response?.data || {};
            setErrors(errorData);
            Toast("error", "Gagal menyimpan hasil pembelajaran");
        } finally {
            setLoading(false);
        }
    };

    const handleEditOutcome = (outcome) => {
        setNewOutcome({
            outcome: outcome.outcome,
        });
        setEditingId(outcome.id);
        setErrors({});
    };

    const handleDeleteOutcome = async (outcomeId) => {
        // ✨ PHASE 4.48: Use SweetAlert2 for better delete confirmation UX
        const result = await Swal.fire({
            title: 'Hapus Hasil Pembelajaran?',
            text: 'Hasil pembelajaran ini akan dihapus secara permanen dari kursus Anda.',
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
            await useAxios.delete(`${API_BASE}/${outcomeId}/`);
            loadOutcomes();
            
            Toast().fire({
                icon: 'success',
                title: 'Hasil Pembelajaran Dihapus',
                text: 'Hasil pembelajaran telah berhasil dihapus dari kursus Anda.',
                timer: 2000,
                timerProgressBar: true,
                showConfirmButton: false
            });
            
            if (onOutcomesUpdate) {
                onOutcomesUpdate();
            }
        } catch (error) {
            console.error("Error deleting outcome:", error);
            Toast().fire({
                icon: 'error',
                title: 'Gagal Menghapus',
                text: 'Terjadi kesalahan saat menghapus hasil pembelajaran. Silakan coba lagi.',
                timer: 3000,
                timerProgressBar: true,
                showConfirmButton: false
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setNewOutcome({ outcome: "" });
        setEditingId(null);
        setErrors({});
    };

    return (
        <div className="form-section">
            <h5 className="section-title mb-3">
                <i className="fas fa-graduation-cap me-2"></i>
                Hasil Pembelajaran
            </h5>

            {/* Learning Outcomes List */}
            {outcomes.length > 0 && (
                <div className="mb-4">
                    <ul className="list-group">
                        {outcomes.map((outcome) => (
                            <li
                                key={outcome.id}
                                className="list-group-item d-flex justify-content-between align-items-center"
                            >
                                <div className="d-flex align-items-center flex-grow-1">
                                    <i className="fas fa-check-circle text-success me-3"></i>
                                    <p className="mb-0">{outcome.outcome}</p>
                                </div>
                                <div className="btn-group" role="group">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-primary"
                                        onClick={() => handleEditOutcome(outcome)}
                                        disabled={loading}
                                    >
                                        <i className="fas fa-edit"></i>
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-danger"
                                        onClick={() => handleDeleteOutcome(outcome.id)}
                                        disabled={loading}
                                    >
                                        <i className="fas fa-trash"></i>
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Add Learning Outcome Form */}
            <div className="card border-light mb-3">
                <div className="card-body">
                    <h6 className="mb-3">
                        {editingId ? "Edit Hasil Pembelajaran" : "Tambah Hasil Pembelajaran Baru"}
                    </h6>

                    <div className="row">
                        <div className="col-12">
                            <FormField
                                label="Deskripsi Hasil Pembelajaran"
                                name="outcome"
                                type="text"
                                value={newOutcome.outcome}
                                onChange={(e) => {
                                    setNewOutcome({
                                        ...newOutcome,
                                        outcome: e.target.value,
                                    });
                                }}
                                placeholder="Contoh: Mampu membuat website responsif dengan HTML dan CSS"
                                errors={errors.outcome || []}
                                required
                            />
                        </div>
                    </div>

                    <div className="mt-3 d-flex gap-2">
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleAddOutcome}
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
                                    Perbarui Hasil Pembelajaran
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-plus me-2"></i>
                                    Tambah Hasil Pembelajaran
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

            {outcomes.length === 0 && !loading && (
                <div className="alert alert-info">
                    <i className="fas fa-info-circle me-2"></i>
                    Belum ada hasil pembelajaran yang ditambahkan. Jelaskan apa yang
                    akan dipelajari peserta didik di kursus Anda di atas.
                </div>
            )}
        </div>
    );
}

// ✨ PHASE 4.177: Memoize component to prevent unnecessary re-renders from parent
export default React.memo(CourseLearningOutcomesForm);
