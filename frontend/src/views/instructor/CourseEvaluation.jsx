import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import LoadingSpinner from "./Partials/LoadingSpinner";
import { useInstructorSidebarCollapse } from "./Partials/useInstructorSidebarCollapse";
import useAxios from "../../utils/useAxios";
import Toast from "../plugin/Toast";
import { getImageUrl, getLevelBadgeStyle, getLevelText } from "../../utils/courseUtils";
import InstructorCourseLeaderboard from "./components/InstructorCourseLeaderboard";
import "./CourseEvaluation.css";

function CourseEvaluation() {
    const { course_id } = useParams();
    const navigate = useNavigate();
    const isCollapsed = useInstructorSidebarCollapse();

    const [course, setCourse] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCourseDetail = async () => {
            if (!course_id) return;
            try {
                setLoading(true);
                const response = await useAxios.get(`teacher/course-detail/${course_id}/?mode=evaluation`);
                if (response.data) {
                    setCourse(response.data);
                }
            } catch (err) {
                console.error("Error fetching course detail for evaluation:", err);
                Toast().fire({
                    icon: "error",
                    title: "Gagal memuat detail kursus",
                    text: "Kursus tidak ditemukan atau terjadi kesalahan server."
                });
            } finally {
                setLoading(false);
            }
        };

        fetchCourseDetail();
    }, [course_id]);

    const levelBadge = course ? getLevelBadgeStyle(course.level) : null;

    return (
        <>
            <BaseHeader title={`Evaluasi & Peringkat - ${course?.title || "Kursus"}`} />
            <section className="course-evaluation-page courses-container courses-main-section">
                <div className="container header-container-aligned">
                    <Header />
                    <div className="row courses-sidebar-content-row evaluation-main-row">
                        <Sidebar />
                        <div className={`col-lg-9 col-md-8 col-12 evaluation-content-column transition-all ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                            
                            {/* Compact & Unified Course Evaluation Header Card */}
                            {loading ? (
                                <div className="ce-compact-header-card d-flex align-items-center justify-content-center py-3">
                                    <LoadingSpinner message="Memuat informasi evaluasi kursus..." />
                                </div>
                            ) : (
                                <div className="ce-compact-header-card">
                                    <div className="ce-compact-header-main">
                                        {/* Course Thumbnail */}
                                        <div className="ce-thumb-wrapper">
                                            <img
                                                src={getImageUrl(course?.image)}
                                                alt={course?.title || "Kursus"}
                                                className="ce-header-thumb"
                                                onError={(e) => {
                                                    e.target.src = "/images/placeholders/default-course.svg";
                                                }}
                                            />
                                        </div>

                                        {/* Course Info & Metadata */}
                                        <div className="ce-info-wrapper">
                                            <div className="ce-meta-row">
                                                <Link
                                                    to="/instructor/courses/"
                                                    className="ce-back-pill"
                                                    title="Kembali ke Daftar Kursus Saya"
                                                >
                                                    <i className="fas fa-arrow-left"></i>
                                                    <span>Kursus Saya</span>
                                                </Link>
                                                <span className="ce-badge-tag ce-badge-eval">
                                                    <i className="fas fa-chart-line"></i> Evaluasi & Analitik
                                                </span>
                                                <span className="ce-badge-tag ce-badge-muted">
                                                    ID: #{course?.course_id || course_id}
                                                </span>
                                                {course?.level && (
                                                    <span 
                                                        className="ce-badge-tag"
                                                        style={{ 
                                                            color: levelBadge?.color,
                                                            backgroundColor: levelBadge?.bg,
                                                            border: `1px solid ${levelBadge?.border}`
                                                        }}
                                                    >
                                                        {getLevelText(course.level)}
                                                    </span>
                                                )}
                                                <span className={`ce-badge-tag ${course?.platform_status === "Published" ? "bg-success-subtle text-success border border-success-subtle" : "bg-secondary-subtle text-secondary border border-secondary-subtle"}`}>
                                                    <i className={`fas ${course?.platform_status === "Published" ? "fa-circle-check" : "fa-clock"}`}></i>
                                                    {course?.platform_status === "Published" ? "Terbit" : "Draf"}
                                                </span>
                                                {course?.category?.title && (
                                                    <span className="ce-badge-tag ce-badge-muted d-none d-sm-inline-flex">
                                                        <i className="fas fa-folder"></i>
                                                        {course.category.title}
                                                    </span>
                                                )}
                                            </div>

                                            <h2 className="ce-course-title" title={course?.title}>
                                                {course?.title || "Evaluasi Kursus"}
                                            </h2>

                                            <div className="ce-subtext">
                                                <i className="fas fa-info-circle text-teal me-1"></i>
                                                Rekapitulasi efektivitas pembelajaran Pre &rarr; Post-Test, ulasan kepuasan siswa, perolehan XP, dan pantauan integritas ujian.
                                            </div>
                                        </div>

                                        {/* Right-aligned Action Buttons */}
                                        <div className="ce-header-actions">
                                            <button
                                                type="button"
                                                className="ce-action-btn ce-btn-excel"
                                                onClick={() => {
                                                    const excelBtn = document.getElementById("btn-trigger-excel");
                                                    if (excelBtn) excelBtn.click();
                                                }}
                                                title="Unduh Rekapitulasi Pelatihan format Excel (.xlsx)"
                                            >
                                                <i className="fas fa-file-excel"></i>
                                                <span>Unduh Excel</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="ce-action-btn ce-btn-pdf"
                                                onClick={() => {
                                                    const pdfBtn = document.getElementById("btn-trigger-pdf");
                                                    if (pdfBtn) pdfBtn.click();
                                                }}
                                                title="Cetak atau Unduh Laporan Rekapitulasi Resmi format PDF"
                                            >
                                                <i className="fas fa-file-pdf"></i>
                                                <span>Cetak PDF</span>
                                            </button>
                                            <Link
                                                to={`/instructor/edit-course/${course_id}/`}
                                                className="ce-action-btn ce-btn-edit"
                                                title="Edit materi kursus ini"
                                            >
                                                <i className="fas fa-pen-to-square"></i>
                                                <span>Edit Kursus</span>
                                            </Link>
                                            <Link
                                                to={`/instructor/preview-course/${course_id}/`}
                                                className="ce-action-btn ce-btn-preview"
                                                title="Pratinjau tampilan kursus"
                                            >
                                                <i className="fas fa-eye"></i>
                                                <span>Pratinjau</span>
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Core Leaderboard & Analytics Component */}
                            <InstructorCourseLeaderboard
                                courseId={course_id || course?.course_id || course?.id}
                                courseTitle={course?.title}
                            />
                        </div>
                    </div>
                </div>
            </section>
            <Footer />
        </>
    );
}

export default CourseEvaluation;
