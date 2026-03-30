import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiInstance from "../../../utils/axios";
import Toast from "../../plugin/Toast";
import { getImageUrl } from "../../../utils/courseUtils";

/**
 * Course Review Tab Component
 * Handles review and approval/rejection of pending courses
 * ✨ PHASE 4: Extracted from CourseReviewAdmin.jsx for merged Content Management
 * ✨ PHASE 4.37: Enhanced with quiz count fix and course detail modal
 */
function CourseReviewTab() {
    const [pendingCourses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState("Review");
    const navigate = useNavigate();

    useEffect(() => {
        fetchPendingCourses();
    }, [filterStatus]);

    const fetchPendingCourses = async () => {
        try {
            setLoading(true);
            const response = await apiInstance.get(`/admin/courses-pending-review/?status=${filterStatus}`);
            console.log("[CourseReviewTab] API Response:", response.data);
            
            // Handle both array and paginated response formats
            let data = [];
            if (Array.isArray(response.data)) {
                data = response.data;
            } else if (response.data?.results) {
                data = response.data.results;
            }
            
            console.log(`[CourseReviewTab] Found ${data.length} courses`);
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

    const handleViewDetails = (course) => {
        // Navigate to dedicated admin course review detail page
        // ✨ PHASE 4.37+: Shows full course details, curriculum, and quizzes for comprehensive review
        if (course.course_id) {
            navigate(`/admin/review-course/${course.course_id}/`);
        } else {
            Toast().fire({
                icon: "error",
                title: "Error",
                text: "Course ID not found. Cannot open review page."
            });
        }
    };

    if (loading) {
        return (
            <div className="cm-tab-content">
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Memuat...</span>
                    </div>
                    <p className="mt-3 text-muted">Memuat kursus yang menunggu review...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="cm-tab-content cm-courses-tab">
            <div className="cm-tab-header d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h3 className="mb-1">
                        <i className="fas fa-check-circle me-2"></i>
                        Review Kursus
                    </h3>
                    <p className="text-muted small mb-0">Tinjau dan setujui atau tolak kursus yang diajukan instruktur</p>
                </div>
                <div className="badge bg-info">{pendingCourses.length} Menunggu</div>
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
                            <div className="cm-card course-review-card">
                                <div className="cm-card-header">
                                    <img
                                        src={getImageUrl(course.image)}
                                        alt={course.title}
                                        className="cm-card-image"
                                        onError={(e) => {
                                            e.target.src = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
                                        }}
                                    />
                                    <span className="cm-status-badge pending">Menunggu Review</span>
                                </div>

                                <div className="cm-card-body">
                                    <h5 className="cm-card-title" style={{ cursor: 'pointer', color: '#0f766e' }} onClick={() => handleViewDetails(course)}>
                                        {course.title}
                                    </h5>
                                    
                                    <div className="cm-card-meta mb-3">
                                        <div className="cm-meta-item">
                                            <i className="fas fa-user me-2"></i>
                                            <span className="text-muted small">
                                                {course.teacher?.full_name || "Unknown"}
                                            </span>
                                        </div>
                                        <div className="cm-meta-item">
                                            <i className="fas fa-tag me-2"></i>
                                            <span className="text-muted small">
                                                {course.category?.title || "N/A"}
                                            </span>
                                        </div>
                                        <div className="cm-meta-item">
                                            <i className="fas fa-graduation-cap me-2"></i>
                                            <span className="text-muted small">
                                                Level: <strong>{course.level || "N/A"}</strong>
                                            </span>
                                        </div>
                                    </div>

                                    <div className="cm-card-stats mb-3 pb-3">
                                        <div className="row text-center">
                                            <div className="col">
                                                <div className="cm-stat-number">{course.curriculum?.length || 0}</div>
                                                <div className="cm-stat-label">Bagian</div>
                                            </div>
                                            <div className="col">
                                                <div className="cm-stat-number">{course.lectures?.length || 0}</div>
                                                <div className="cm-stat-label">Pelajaran</div>
                                            </div>
                                            <div className="col">
                                                <div className="cm-stat-number">{course.quizzes?.length || 0}</div>
                                                <div className="cm-stat-label">Kuis</div>
                                            </div>
                                        </div>
                                    </div>

                                    {course.review_submitted_date && (
                                        <div className="text-muted small mb-3">
                                            <i className="fas fa-calendar-alt me-1"></i>
                                            Diajukan: {new Date(course.review_submitted_date).toLocaleDateString('id-ID', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })}
                                        </div>
                                    )}

                                    <div className="cm-card-actions d-flex gap-2">
                                        <button
                                            className="btn btn-info btn-sm flex-grow-1"
                                            onClick={() => handleViewDetails(course)}
                                            title="Lihat detail lengkap kursus untuk review dan tentukan approve/reject"
                                        >
                                            <i className="fas fa-eye me-1"></i>
                                            Lihat Detail dan Review
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default React.memo(CourseReviewTab);
