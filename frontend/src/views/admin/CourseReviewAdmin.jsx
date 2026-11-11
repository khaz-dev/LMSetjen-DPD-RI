import React, { useState, useEffect } from "react";
import AdminHeader from "../partials/AdminHeader";
import Footer from "../partials/Footer";
import apiInstance from "../../utils/axios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import Swal from "sweetalert2";
import { getImageUrl, getCourseCurriculumSummary } from "../../utils/courseUtils";
import "./CourseReviewAdmin.css";

function CourseReviewAdmin() {
    const [pendingCourses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState("Review");
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [rejectionReason, setRejectionReason] = useState("");
    const userData = UserData();

    useEffect(() => {
        fetchPendingCourses();
    }, [filterStatus]);

    const fetchPendingCourses = async () => {
        try {
            setLoading(true);
            const response = await apiInstance.get(`/admin/courses-pending-review/?status=${filterStatus}`);
            console.log("[CourseReviewAdmin] API Response:", response.data);
            
            // Handle both array and paginated response formats
            let data = [];
            if (Array.isArray(response.data)) {
                data = response.data;
            } else if (response.data?.results) {
                data = response.data.results;
            }
            
            console.log(`[CourseReviewAdmin] Found ${data.length} courses`);
            setCourses(data);
        } catch (error) {
            console.error("Error fetching pending courses:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat kursus",
                text: error.response?.data?.detail || "Terjadi kesalahan saat memuat data"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleApproveCourse = async (course) => {
        const result = await Swal.fire({
            title: `Setujui Kursus "${course.title}"?`,
            html: `
                <div class="text-start">
                    <p>Instruktur: <strong>${course.teacher?.full_name || "Unknown"}</strong></p>
                    <p>Kategori: <strong>${course.category?.title || "N/A"}</strong></p>
                    <p class="text-muted small">Kursus ini akan dipublikasikan dan tersedia untuk peserta.</p>
                </div>
            `,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#4CAF50",
            cancelButtonColor: "#d33",
            confirmButtonText: "Ya, Setujui",
            cancelButtonText: "Batal"
        });

        if (result.isConfirmed) {
            try {
                await apiInstance.post(`/admin/course-approval/${course.course_id}/`, {
                    action: "approve"
                });
                
                Toast().fire({
                    icon: "success",
                    title: "Kursus Disetujui",
                    text: `"${course.title}" telah disetujui dan dipublikasikan`
                });
                
                fetchPendingCourses();
            } catch (error) {
                Toast().fire({
                    icon: "error",
                    title: "Gagal menyetujui kursus",
                    text: error.response?.data?.detail || "Terjadi kesalahan"
                });
            }
        }
    };

    const handleRejectCourse = async (course) => {
        const { value: reason } = await Swal.fire({
            title: `Tolak Kursus "${course.title}"?`,
            input: "textarea",
            inputLabel: "Alasan Penolakan",
            inputPlaceholder: "Jelaskan mengapa kursus ini ditolak dan apa yang perlu diperbaiki...",
            inputAttributes: {
                "aria-label": "Alasan penolakan"
            },
            showCancelButton: true,
            confirmButtonColor: "#dc3545",
            cancelButtonColor: "#6c757d",
            confirmButtonText: "Ya, Tolak Kursus",
            cancelButtonText: "Batal",
            inputValidator: (value) => {
                if (!value || value.trim().length < 10) {
                    return "Alasan penolakan harus setidaknya 10 karakter!";
                }
            }
        });

        if (reason) {
            try {
                await apiInstance.post(`/admin/course-approval/${course.course_id}/`, {
                    action: "reject",
                    rejection_reason: reason
                });
                
                Toast().fire({
                    icon: "success",
                    title: "Kursus Ditolak",
                    text: `"${course.title}" telah ditolak dan instruktur dapat melihat alasan`
                });
                
                fetchPendingCourses();
            } catch (error) {
                Toast().fire({
                    icon: "error",
                    title: "Gagal menolak kursus",
                    text: error.response?.data?.detail || "Terjadi kesalahan"
                });
            }
        }
    };

    if (loading) {
        return (
            <div className="admin-page-wrapper">
                <AdminHeader />
                <main className="admin-dashboard-container d-flex align-items-center justify-content-center" style={{ minHeight: "60vh" }}>
                    <div className="text-center py-5">
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Memuat...</span>
                        </div>
                        <p className="mt-3 text-muted">Memuat kursus yang menunggu review...</p>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="admin-page-wrapper">
            <AdminHeader />
            
            <main className="admin-dashboard-container">
                <div className="container-fluid px-3 px-xl-4 footer-container">
                    <div className="course-review-container">
                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <div>
                                <h2 className="section-title mb-1">
                                    <i className="fas fa-check-circle me-2"></i>
                                    Review Kursus
                                </h2>
                                <p className="text-muted small">Tinjau dan setujui atau tolak kursus yang diajukan instruktur</p>
                            </div>
                            <div className="badge bg-info">{pendingCourses.length} Kursus Menunggu</div>
                        </div>

                        {pendingCourses.length === 0 ? (
                            <div className="alert alert-info text-center">
                                <i className="fas fa-info-circle me-2"></i>
                                Tidak ada kursus yang menunggu review saat ini
                            </div>
                        ) : (
                            <div className="row">
                                {pendingCourses.map((course) => (
                                    <div key={course.course_id} className="col-lg-6 mb-4">
                                        <div className="course-review-card">
                                            <div className="course-review-header">
                                                <img
                                                    src={getImageUrl(course.image)}
                                                    alt={course.title}
                                                    className="course-review-image"
                                                    onError={(e) => {
                                                        e.target.src = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
                                                    }}
                                                />
                                                <span className="status-badge pending">Menunggu Review</span>
                                            </div>

                                            <div className="course-review-body p-4">
                                                <h5 className="course-title mb-2">{course.title}</h5>
                                                
                                                <div className="course-meta mb-3">
                                                    <div className="meta-item">
                                                        <i className="fas fa-user me-2 text-muted"></i>
                                                        <span className="text-muted small">
                                                            {course.teacher?.full_name || "Unknown"}
                                                        </span>
                                                    </div>
                                                    <div className="meta-item">
                                                        <i className="fas fa-tag me-2 text-muted"></i>
                                                        <span className="text-muted small">
                                                            {course.category?.title || "N/A"}
                                                        </span>
                                                    </div>
                                                    <div className="meta-item">
                                                        <i className="fas fa-graduation-cap me-2 text-muted"></i>
                                                        <span className="text-muted small">
                                                            Level: <strong>{course.level || "N/A"}</strong>
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="course-description mb-3">
                                                    <p className="text-muted small mb-2">
                                                        {course.description ? course.description.substring(0, 100) + "..." : "Tidak ada deskripsi"}
                                                    </p>
                                                </div>

                                                <div className="course-stats mb-3 pb-3 border-bottom">
                                                    {(() => {
                                                        const { sectionsCount, lessonsCount, quizzesCount } = getCourseCurriculumSummary(course);
                                                        return (
                                                            <div className="row text-center">
                                                                <div className="col">
                                                                    <div className="stat-number">
                                                                        {sectionsCount}
                                                                    </div>
                                                                    <div className="stat-label">Bagian</div>
                                                                </div>
                                                                <div className="col">
                                                                    <div className="stat-number">
                                                                        {lessonsCount}
                                                                    </div>
                                                                    <div className="stat-label">Pelajaran</div>
                                                                </div>
                                                                <div className="col">
                                                                    <div className="stat-number">
                                                                        {quizzesCount}
                                                                    </div>
                                                                    <div className="stat-label">Kuis</div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>

                                                <div className="submission-info text-muted small mb-3">
                                                    {course.review_submitted_date && (
                                                        <div>
                                                            <i className="fas fa-calendar-alt me-1"></i>
                                                            Diajukan: {new Date(course.review_submitted_date).toLocaleDateString('id-ID', {
                                                                year: 'numeric',
                                                                month: 'long',
                                                                day: 'numeric'
                                                            })}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="course-review-actions d-flex gap-2">
                                                    <button
                                                        className="btn btn-success btn-sm flex-grow-1"
                                                        onClick={() => handleApproveCourse(course)}
                                                    >
                                                        <i className="fas fa-check me-1"></i>
                                                        Setujui
                                                    </button>
                                                    <button
                                                        className="btn btn-danger btn-sm flex-grow-1"
                                                        onClick={() => handleRejectCourse(course)}
                                                    >
                                                        <i className="fas fa-times me-1"></i>
                                                        Tolak
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}

export default React.memo(CourseReviewAdmin);
