import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import useAxios from "../../../utils/useAxios";
import Toast from "../../plugin/Toast";
import FormField from "./FormField";

/**
 * ✨ PHASE 4.45: CourseFeaturesForm Component
 * Allows instructors to manage course features (what's included in the course)
 */
function CourseFeaturesForm({ courseId, onFeaturesUpdate }) {
    // ✨ PHASE 4.177: Fetch guard to prevent duplicate API calls
    const hasFetchedRef = React.useRef(false);
    const [features, setFeatures] = useState([]);
    const [newFeature, setNewFeature] = useState({
        icon: "",
        text: "",
        highlight: false,
    });
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [editingId, setEditingId] = useState(null);

    const API_BASE = `teacher/course-features/${courseId}`;

    // Load existing features
    // ✨ PHASE 4.177: Add fetch guard to prevent duplicate calls on re-render
    useEffect(() => {
        if (courseId && !hasFetchedRef.current) {
            hasFetchedRef.current = true;
            loadFeatures();
        }
    }, [courseId]);

    const loadFeatures = async () => {
        try {
            setLoading(true);
            const response = await useAxios.get(API_BASE + "/");
            setFeatures(response.data?.results || response.data || []);
        } catch (error) {
            console.error("Error loading features:", error);
            Toast("error", "Gagal memuat fitur kursus");
        } finally {
            setLoading(false);
        }
    };

    const validateFeature = () => {
        const newErrors = {};
        if (!newFeature.text?.trim()) {
            newErrors.text = ["Deskripsi fitur tidak boleh kosong"];
        }
        if (!newFeature.icon?.trim()) {
            newErrors.icon = ["Ikon tidak boleh kosong"];
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleAddFeature = async () => {
        if (!validateFeature()) return;

        try {
            setLoading(true);
            const payload = {
                icon: newFeature.icon,
                text: newFeature.text,
                highlight: newFeature.highlight,
            };

            if (editingId) {
                // Update existing feature
                await useAxios.patch(API_BASE + `/${editingId}/`, payload);
                setEditingId(null);
            } else {
                // Create new feature
                const response = await useAxios.post(API_BASE + "/", payload);
            }

            // Reset form and reload features
            setNewFeature({ icon: "", text: "", highlight: false });
            setErrors({});
            loadFeatures();
            
            if (onFeaturesUpdate) {
                onFeaturesUpdate();
            }
        } catch (error) {
            console.error("Error saving feature:", error);
            const errorData = error.response?.data || {};
            setErrors(errorData);
            Toast("error", "Gagal menyimpan fitur");
        } finally {
            setLoading(false);
        }
    };

    const handleEditFeature = (feature) => {
        setNewFeature({
            icon: feature.icon,
            text: feature.text,
            highlight: feature.highlight,
        });
        setEditingId(feature.id);
        setErrors({});
    };

    const handleDeleteFeature = async (featureId) => {
        // ✨ PHASE 4.48: Use SweetAlert2 for better delete confirmation UX
        const result = await Swal.fire({
            title: 'Hapus Fitur?',
            text: 'Fitur ini akan dihapus secara permanen dari kursus Anda.',
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
            await useAxios.delete(`${API_BASE}/${featureId}/`);
            loadFeatures();
            
            Toast().fire({
                icon: 'success',
                title: 'Fitur Dihapus',
                text: 'Fitur telah berhasil dihapus dari kursus Anda.',
                timer: 2000,
                timerProgressBar: true,
                showConfirmButton: false
            });
            
            if (onFeaturesUpdate) {
                onFeaturesUpdate();
            }
        } catch (error) {
            console.error("Error deleting feature:", error);
            Toast().fire({
                icon: 'error',
                title: 'Gagal Menghapus',
                text: 'Terjadi kesalahan saat menghapus fitur. Silakan coba lagi.',
                timer: 3000,
                timerProgressBar: true,
                showConfirmButton: false
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setNewFeature({ icon: "", text: "", highlight: false });
        setEditingId(null);
        setErrors({});
    };

    const commonIcons = [
        { value: "fas fa-check", label: "✓ Centang" },
        { value: "fas fa-book", label: "📖 Buku" },
        { value: "fas fa-video", label: "🎥 Video" },
        { value: "fas fa-document", label: "📄 Dokumen" },
        { value: "fas fa-users", label: "👥 Komunitas" },
        { value: "fas fa-certificate", label: "🎓 Sertifikat" },
        { value: "fas fa-clock", label: "⏰ Waktu Fleksibel" },
        { value: "fas fa-globe", label: "🌐 Akses Seumur Hidup" },
        { value: "fas fa-star", label: "⭐ Premium" },
        { value: "fas fa-desktop", label: "💻 Akses Mobile" },
        { value: "fas fa-download", label: "📥 Materi Downloadable" },
        { value: "fas fa-headphones", label: "🎧 Dukungan 24/7" },
    ];

    return (
        <div className="form-section">
            <h5 className="section-title mb-3">
                <i className="fas fa-box-open me-2"></i>
                Kursus ini termasuk (Fitur)
            </h5>

            {/* Features List */}
            {features.length > 0 && (
                <div className="mb-4">
                    <div className="list-group">
                        {features.map((feature) => (
                            <div
                                key={feature.id}
                                className="list-group-item d-flex justify-content-between align-items-center"
                            >
                                <div className="d-flex align-items-center">
                                    <i className={`${feature.icon} me-3 text-primary`}></i>
                                    <div>
                                        <p className="mb-1">{feature.text}</p>
                                        {feature.highlight && (
                                            <small className="badge bg-warning text-dark">
                                                Disorot
                                            </small>
                                        )}
                                    </div>
                                </div>
                                <div className="btn-group" role="group">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-primary"
                                        onClick={() => handleEditFeature(feature)}
                                        disabled={loading}
                                    >
                                        <i className="fas fa-edit"></i>
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-danger"
                                        onClick={() => handleDeleteFeature(feature.id)}
                                        disabled={loading}
                                    >
                                        <i className="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Add Feature Form */}
            <div className="card border-light mb-3">
                <div className="card-body">
                    <h6 className="mb-3">
                        {editingId ? "Edit Fitur" : "Tambah Fitur Baru"}
                    </h6>

                    <div className="row">
                        <div className="col-md-6">
                            <FormField
                                label="Pilih Ikon"
                                name="icon"
                                type="select"
                                value={newFeature.icon}
                                onChange={(e) => {
                                    setNewFeature({ ...newFeature, icon: e.target.value });
                                }}
                                errors={errors.icon || []}
                                options={[
                                    { value: "", label: "-- Pilih Ikon --" },
                                    ...commonIcons,
                                ]}
                                required
                            />
                        </div>

                        <div className="col-md-6">
                            <FormField
                                label="Deskripsi Fitur"
                                name="text"
                                type="text"
                                value={newFeature.text}
                                onChange={(e) => {
                                    setNewFeature({ ...newFeature, text: e.target.value });
                                }}
                                placeholder="Contoh: Akses Seumur Hidup ke Materi Kursus"
                                errors={errors.text || []}
                                required
                            />
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-12">
                            {/* ✨ PHASE 4.61: Using modern-form-check for proper checkbox alignment */}
                            <div 
                                className="form-check modern-form-check"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '12px',
                                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(102, 126, 234, 0.2)',
                                    margin: '0'
                                }}
                            >
                                <input
                                    type="checkbox"
                                    className="form-check-input"
                                    id="highlightFeature"
                                    checked={newFeature.highlight}
                                    style={{
                                        width: '20px',
                                        height: '20px',
                                        minWidth: '20px',
                                        minHeight: '20px',
                                        border: '2px solid #cbd5e1',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        margin: '0',
                                        padding: '0',
                                        flexShrink: '0'
                                    }}
                                    onChange={(e) => {
                                        setNewFeature({
                                            ...newFeature,
                                            highlight: e.target.checked,
                                        });
                                    }}
                                />
                                <label
                                    className="form-check-label"
                                    htmlFor="highlightFeature"
                                    style={{
                                        cursor: 'pointer',
                                        margin: '0',
                                        color: '#1e293b',
                                        fontWeight: '500',
                                        flex: '1',
                                        display: 'flex',
                                        alignItems: 'center',
                                        userSelect: 'none'
                                    }}
                                >
                                    Sorot fitur ini di halaman detail kursus
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 d-flex gap-2">
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleAddFeature}
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
                                    Perbarui Fitur
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-plus me-2"></i>
                                    Tambah Fitur
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

            {features.length === 0 && !loading && (
                <div className="alert alert-info">
                    <i className="fas fa-info-circle me-2"></i>
                    Belum ada fitur yang ditambahkan. Mulai dengan menambahkan fitur
                    utama kursus Anda di atas.
                </div>
            )}
        </div>
    );
}

// ✨ PHASE 4.177: Memoize component to prevent unnecessary re-renders from parent
export default React.memo(CourseFeaturesForm);
